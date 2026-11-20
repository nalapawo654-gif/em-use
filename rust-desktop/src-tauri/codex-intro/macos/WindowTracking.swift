import AppKit

struct TrackedWindow: Equatable {
    let id: CGWindowID
    let pid: pid_t
    let frame: CGRect
    let layer: Int
    let alpha: Double

    var isMainCandidate: Bool {
        layer == 0 && alpha > 0 && frame.width >= 360 && frame.height >= 240
    }
}

enum WindowSelection {
    static func cocoaFrame(_ frame: CGRect, primaryHeight: CGFloat) -> CGRect {
        CGRect(x: frame.minX, y: primaryHeight - frame.maxY,
               width: frame.width, height: frame.height)
    }
}

struct PlaybackHistory {
    private var presented: [pid_t: Set<CGWindowID>] = [:]
    func contains(pid: pid_t, window: CGWindowID) -> Bool {
        presented[pid]?.contains(window) ?? false
    }
    mutating func mark(pid: pid_t, window: CGWindowID) {
        presented[pid, default: []].insert(window)
    }
    mutating func terminate(pid: pid_t) { presented.removeValue(forKey: pid) }
}

enum WindowInventory {
    static func read() -> [TrackedWindow] {
        guard let entries = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements],
                                                       kCGNullWindowID) as? [[String: Any]] else { return [] }
        return entries.compactMap { entry in
            guard let id = entry[kCGWindowNumber as String] as? UInt32,
                  let pid = entry[kCGWindowOwnerPID as String] as? Int32,
                  let layer = entry[kCGWindowLayer as String] as? Int,
                  let bounds = entry[kCGWindowBounds as String] as? NSDictionary,
                  let frame = CGRect(dictionaryRepresentation: bounds) else { return nil }
            return TrackedWindow(id: id, pid: pid, frame: frame, layer: layer,
                                 alpha: entry[kCGWindowAlpha as String] as? Double ?? 1)
        }
    }
}
