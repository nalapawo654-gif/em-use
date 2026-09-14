use chrono::{DateTime, Utc};
use serde_json::{json, Value};
pub fn now() -> i64 {
    Utc::now().timestamp_millis()
}
pub fn contract() -> Value {
    serde_json::from_str(include_str!("settings-contract.json")).unwrap()
}
pub fn validate(input: &Value) -> Value {
    let c = contract();
    let mut out = json!({});
    if let Some(data) = input.as_object() {
        for (key, value) in data {
            if c["defaults"][key].is_boolean() && value.is_boolean() {
                out[key] = value.clone();
            }
            if c["enums"][key]
                .as_array()
                .is_some_and(|values| values.contains(value))
            {
                out[key] = value.clone();
            }
            if key == "messagePausedUntil" {
                if let Some(n) = value.as_f64().filter(|n| n.is_finite()) {
                    out[key] = json!(n.clamp(0., (now() + 86_400_000) as f64).round() as i64);
                }
            }
            if key == "windowWidth" {
                if let Some(n) = value.as_f64().filter(|n| n.is_finite()) {
                    out[key] = json!(n.clamp(180., 800.).round() as u32);
                }
            }
        }
    }
    out
}
pub fn merge(dest: &mut Value, patch: &Value) {
    for (k, v) in patch.as_object().unwrap() {
        dest[k] = v.clone();
    }
}
pub fn parse_time(raw: &str) -> Option<i64> {
    let raw = if raw.len() == 19 || (raw.len() > 19 && !raw[19..].contains(['Z', 'z', '+', '-'])) {
        format!("{raw}+08:00")
    } else {
        raw.into()
    };
    DateTime::parse_from_rfc3339(&raw)
        .ok()
        .map(|t| t.timestamp_millis())
}
pub fn day(ms: i64) -> String {
    DateTime::from_timestamp_millis(ms + 8 * 3600_000)
        .unwrap()
        .format("%Y-%m-%d")
        .to_string()
}
pub fn normalize(body: Value, received: i64) -> Result<Value, (&'static str, &'static str)> {
    match body["code"].as_str() {
        Some("000401" | "401") => return Err(("expired", "登录已过期，请重新登录")),
        Some("000403" | "403") => return Err(("forbidden", "当前账号暂无个人额度访问权限")),
        Some("000200") => (),
        _ => return Err(("unavailable", "平台暂未返回有效额度，请稍后重试")),
    }
    let d = &body["data"];
    let decimal = |v: &Value| -> Option<f64> {
        v.as_f64()
            .or_else(|| {
                v.as_str().and_then(|s| {
                    let parts: Vec<_> = s.split('.').collect();
                    if parts.len() > 2
                        || parts
                            .iter()
                            .any(|p| p.is_empty() || !p.chars().all(|c| c.is_ascii_digit()))
                    {
                        return None;
                    }
                    s.parse().ok()
                })
            })
            .filter(|v| v.is_finite())
    };
    let invalid = ("unavailable", "额度或费用更新时间暂不可用");
    let limit = decimal(&d["dailyCostLimit"]).ok_or(invalid)?;
    let used = decimal(&d["currentDayCost"]).ok_or(invalid)?;
    let estimate = d["lastCostEstimateTime"]
        .as_str()
        .and_then(parse_time)
        .ok_or(invalid)?;
    let server = d["currentTime"]
        .as_str()
        .and_then(parse_time)
        .ok_or(invalid)?;
    if limit <= 0. || used < 0. || estimate > server + 60_000 {
        return Err(invalid);
    }
    let remaining = ((limit * 10000.).round() - (used * 10000.).round()).max(0.) / 10000.;
    Ok(
        json!({"limit":limit,"used":used,"remaining":remaining,"percent":(remaining/limit*100.).clamp(0.,100.),"exceeded":d["quotaExceeded"]==true || used>=limit,"estimatedAt":d["lastCostEstimateTime"],"serverAt":d["currentTime"],"receivedAt":received,"day":day(estimate)}),
    )
}
pub fn freshness(q: &Value, time: i64) -> &'static str {
    let server = q["serverAt"].as_str().and_then(parse_time).unwrap_or(time);
    if q["day"] != day(time.max(server)) {
        "resetting"
    } else if time - q["estimatedAt"].as_str().and_then(parse_time).unwrap_or(0) > 15 * 60_000
        || time - q["receivedAt"].as_i64().unwrap_or(0) > 3 * 60_000
    {
        "stale"
    } else {
        "ready"
    }
}
#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
pub fn fit(b: Bounds, a: Bounds) -> Bounds {
    let w = b
        .width
        .clamp(180., 800.)
        .min(a.width)
        .min(a.height)
        .max(1.)
        .round();
    Bounds {
        x: (b.x.max(a.x).min(a.x + a.width - w) + 0.5).floor(),
        y: (b.y.max(a.y).min(a.y + a.height - w) + 0.5).floor(),
        width: w,
        height: w,
    }
}
pub fn gesture(b: Bounds, dx: f64, dy: f64, mode: &str, a: Bounds) -> Bounds {
    if mode == "move" {
        return fit(
            Bounds {
                x: b.x + dx,
                y: b.y + dy,
                ..b
            },
            a,
        );
    }
    let west = mode.contains('w');
    let north = mode.contains('n');
    let delta = ((if west { -dx } else { dx }) + (if north { -dy } else { dy })) / 2.;
    let ax = if west { b.x + b.width } else { b.x };
    let ay = if north { b.y + b.height } else { b.y };
    let max = (if west { ax - a.x } else { a.x + a.width - ax })
        .min(if north { ay - a.y } else { a.y + a.height - ay })
        .max(1.);
    let w = (b.width + delta).clamp(180., 800.).min(max).round();
    fit(
        Bounds {
            x: if west { ax - w } else { ax },
            y: if north { ay - w } else { ay },
            width: w,
            height: w,
        },
        a,
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn contract_validation() {
        assert_eq!(
            validate(
                &json!({"scene":"battery","windowWidth":900,"clickThrough":"true","token":"secret"})
            ),
            json!({"scene":"battery","windowWidth":800})
        );
    }
    #[test]
    fn quota_money_and_midnight() {
        let time = parse_time("2026-09-11T23:59:00").unwrap();
        let q=normalize(json!({"code":"000200","data":{"dailyCostLimit":"0.3","currentDayCost":"0.1","lastCostEstimateTime":"2026-09-11T23:59:00","currentTime":"2026-09-11T23:59:00"}}),time).unwrap();
        assert_eq!(q["remaining"], json!(0.2));
        assert_eq!(freshness(&q, time), "ready");
        assert_eq!(freshness(&q, time + 60_000), "resetting");
    }
    #[test]
    fn forbidden_and_invalid() {
        assert_eq!(
            normalize(json!({"code":"000403"}), 0).unwrap_err().0,
            "forbidden"
        );
        assert!(normalize(json!({"code":"000200","data":{}}), 0).is_err());
    }
    #[test]
    fn geometry() {
        let a = Bounds {
            x: -1000.,
            y: 0.,
            width: 1000.,
            height: 760.,
        };
        let b = fit(
            Bounds {
                x: 500.,
                y: 700.,
                width: 440.,
                height: 440.,
            },
            a,
        );
        assert_eq!(b.x, -440.);
        assert_eq!(b.y, 320.);
        for m in ["nw", "ne", "sw", "se"] {
            let n = gesture(b, 10., 20., m, a);
            assert_eq!(n.width, n.height);
            assert!(n.x >= a.x && n.y >= a.y);
        }
    }
}

#[cfg(test)]
mod parity_tests {
    use super::*;
    #[test]
    fn original_typescript_behavior_contract() {
        let fixtures: Value = serde_json::from_str(include_str!("behavior-contract.json")).unwrap();
        for case in fixtures["quota"].as_array().unwrap() {
            let actual = normalize(case["body"].clone(), case["now"].as_i64().unwrap());
            if let Some(error) = case["error"].as_str() {
                assert_eq!(actual.unwrap_err().0, error, "{}", case);
            } else {
                let q = actual.unwrap();
                for (key, value) in q.as_object().unwrap() {
                    let expected = &case["result"][key];
                    if value.is_number() {
                        assert!(
                            (value.as_f64().unwrap() - expected.as_f64().unwrap()).abs() < 1e-10,
                            "{key}: {value} vs {expected}"
                        );
                    } else {
                        assert_eq!(value, expected, "{key}");
                    }
                }
                for f in case["freshness"].as_array().unwrap() {
                    assert_eq!(
                        freshness(&q, f["now"].as_i64().unwrap()),
                        f["status"].as_str().unwrap()
                    );
                }
            }
        }
        for c in fixtures["geometry"].as_array().unwrap() {
            let start: Bounds = serde_json::from_value(c["start"].clone()).unwrap();
            let area: Bounds = serde_json::from_value(c["area"].clone()).unwrap();
            let expected: Bounds = serde_json::from_value(c["result"].clone()).unwrap();
            assert_eq!(
                gesture(
                    start,
                    c["dx"].as_f64().unwrap(),
                    c["dy"].as_f64().unwrap(),
                    c["mode"].as_str().unwrap(),
                    area
                ),
                expected,
                "{}",
                c
            );
        }
    }
}
