//! A hide invalidates in-flight popup creation, even if the pet is restored before it ends.
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
pub struct MessagePopupGate(AtomicU64);

impl MessagePopupGate {
    pub fn ticket(&self) -> u64 {
        self.0.load(Ordering::SeqCst)
    }
    pub fn hide(&self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
    pub fn allows(&self, ticket: u64, visible: Result<bool, ()>) -> bool {
        visible == Ok(true) && ticket == self.ticket()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hidden_missing_or_unreadable_pet_never_allows_a_popup() {
        let gate = MessagePopupGate::default();
        let ticket = gate.ticket();
        assert!(gate.allows(ticket, Ok(true)));
        assert!(!gate.allows(ticket, Ok(false)));
        assert!(!gate.allows(ticket, Err(())));
    }
    #[test]
    fn hide_cancels_in_flight_creation_even_after_restore() {
        let gate = MessagePopupGate::default();
        let pending = gate.ticket();
        gate.hide();
        assert!(!gate.allows(pending, Ok(false)));
        assert!(!gate.allows(pending, Ok(true)));
        let fresh = gate.ticket();
        assert!(gate.allows(fresh, Ok(true)));
        gate.hide();
        assert!(!gate.allows(fresh, Ok(true)));
    }
}
