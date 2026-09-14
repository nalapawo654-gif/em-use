// WebView2 can emit blur while focus moves between the host and its webview.
// Ignore pre-activation blur and invalidate delayed checks after another event.
#[derive(Default)]
pub struct MessagePanelFocus {
    activated: bool,
    revision: u64,
}

impl MessagePanelFocus {
    pub fn changed(&mut self, focused: bool) -> Option<u64> {
        self.revision += 1;
        self.activated |= focused;
        (!focused && self.activated).then_some(self.revision)
    }

    pub fn should_close(&self, revision: u64, focused: Result<bool, ()>) -> bool {
        self.activated && self.revision == revision && focused == Ok(false)
    }

    pub fn destroyed(&mut self) {
        self.revision += 1;
        self.activated = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hidden_window_does_not_close_before_first_activation() {
        let mut focus = MessagePanelFocus::default();
        assert_eq!(focus.changed(false), None);
        assert_eq!(focus.changed(false), None);
    }

    #[test]
    fn webview_blur_does_not_close_an_active_host_window() {
        let mut focus = MessagePanelFocus::default();
        focus.changed(true);
        let check = focus.changed(false).unwrap();
        assert!(!focus.should_close(check, Ok(true)));
        assert!(!focus.should_close(check, Err(())));
        assert!(focus.should_close(check, Ok(false)));
    }

    #[test]
    fn refocus_cancels_pending_close() {
        let mut focus = MessagePanelFocus::default();
        focus.changed(true);
        let first = focus.changed(false).unwrap();
        focus.changed(true);
        assert!(!focus.should_close(first, Ok(false)));
        let second = focus.changed(false).unwrap();
        assert!(!focus.should_close(first, Ok(false)));
        assert!(focus.should_close(second, Ok(false)));
    }

    #[test]
    fn destroyed_window_cancels_pending_close() {
        let mut focus = MessagePanelFocus::default();
        focus.changed(true);
        let check = focus.changed(false).unwrap();
        focus.destroyed();
        assert!(!focus.should_close(check, Ok(false)));
    }
}
