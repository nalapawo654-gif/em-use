import AppKit

func report(_ event: String) {
    FileHandle.standardOutput.write(Data((event + "\n").utf8))
}

final class Host {
    private let bundleID: String
    private let media: URL
    private var theme: String
    private var history = PlaybackHistory()
    private var player: Player?
    private var process: pid_t?
    private var replayUntil: Date?
    private var timer: Timer?
    private var interval: TimeInterval = 0

    init(media: URL, theme: String, bundleID: String) {
        self.media = media
        self.theme = theme
        self.bundleID = bundleID
    }

    func command(_ line: String) {
        switch line {
        case "dragon", "emerald": theme = line
        case "stop": stop()
        case "replay":
            stop()
            guard let codex = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first else {
                report("missing"); return
            }
            replayUntil = Date().addingTimeInterval(15)
            codex.activate(options: [.activateIgnoringOtherApps])
            tick()
        default: break
        }
    }

    private func stop() {
        player = nil
        replayUntil = nil
        schedule(0.35)
    }

    private func schedule(_ seconds: TimeInterval) {
        guard interval != seconds else { return }
        interval = seconds
        timer?.invalidate()
        let next = Timer(timeInterval: seconds, repeats: true) { [weak self] _ in self?.tick() }
        timer = next
        RunLoop.main.add(next, forMode: .common)
    }

    func tick() {
        var following = false
        defer { schedule(following ? 1.0 / 30 : 0.35) }
        if let deadline = replayUntil, Date() >= deadline { replayUntil = nil; report("missing") }
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion { stop(); return }
        let front = NSWorkspace.shared.frontmostApplication
        let pid = front?.bundleIdentifier == bundleID ? front?.processIdentifier : nil
        if let old = process, NSRunningApplication(processIdentifier: old)?.bundleIdentifier != bundleID {
            history.terminate(pid: old)
            process = nil
            player = nil
        }
        // WindowServer may omit a minimized window even from the inventory of
        // all windows. Keep one paused session until its process exits, a new
        // window plays, or the user stops it.
        guard let pid else { player?.update(nil); return }
        process = pid
        let windows = WindowInventory.read()
        // A smaller foreground dialog covers its owner. Never draw over that dialog.
        let top = windows.first { $0.pid == pid && $0.layer == 0 && $0.alpha > 0 &&
            $0.frame.width >= 100 && $0.frame.height >= 80 }
        guard let target = top, target.isMainCandidate else { player?.update(nil); return }
        if let active = player, active.target.id == target.id && active.target.pid == pid {
            active.update(target)
            following = player != nil
            return
        }
        if replayUntil == nil && history.contains(pid: pid, window: target.id) {
            player?.update(nil)
            return
        }
        stop()
        history.mark(pid: pid, window: target.id)
        player = Player(target: target, url: media.appendingPathComponent(theme + ".mp4")) { [weak self] in self?.stop() }
        report("playing")
        player?.update(target)
        following = true
    }
}
