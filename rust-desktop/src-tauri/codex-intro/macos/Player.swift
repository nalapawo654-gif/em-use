import AppKit
import AVFoundation

/// Two nonactivating panels keep only the Skip button interactive.
final class Player: NSObject {
    let target: TrackedWindow
    private let film: NSPanel
    private let controls: NSPanel
    private let movie: AVPlayer
    private var tokens: [NSObjectProtocol] = []
    private var visible = false
    private var frame = CGRect.zero
    private var visibleSince: TimeInterval?
    private var elapsed: TimeInterval = 0
    private let finish: () -> Void

    init(target: TrackedWindow, url: URL, finish: @escaping () -> Void) {
        self.target = target
        self.finish = finish
        movie = AVPlayer(url: url)
        movie.volume = 0.55
        func panel() -> NSPanel {
            let p = NSPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel],
                            backing: .buffered, defer: false)
            p.level = .floating
            p.hidesOnDeactivate = false
            p.isReleasedWhenClosed = false
            p.hasShadow = false
            p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
            return p
        }
        film = panel()
        controls = panel()
        super.init()
        film.ignoresMouseEvents = true
        film.backgroundColor = .black
        let view = NSView()
        view.wantsLayer = true
        let layer = AVPlayerLayer(player: movie)
        layer.videoGravity = .resizeAspect
        view.layer = layer
        film.contentView = view
        controls.backgroundColor = .clear
        controls.isOpaque = false
        controls.contentView = NSButton(title: "跳过  ›", target: self, action: #selector(skip))
        let center = NotificationCenter.default
        tokens.append(center.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: movie.currentItem,
                                         queue: .main) { [weak self] _ in self?.finish() })
        tokens.append(center.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: movie.currentItem,
                                         queue: .main) { [weak self] _ in self?.fail() })
    }

    @objc private func skip() { finish() }
    private func fail() { report("failed"); finish() }

    func update(_ window: TrackedWindow?) {
        let now = ProcessInfo.processInfo.systemUptime
        if let start = visibleSince { elapsed += now - start }
        visibleSince = window == nil ? nil : now
        guard let window else {
            if visible { movie.pause(); controls.orderOut(nil); film.orderOut(nil); visible = false }
            return
        }
        if elapsed > 20 || movie.currentItem?.status == .failed { fail(); return }
        let rect = WindowSelection.cocoaFrame(window.frame, primaryHeight: CGDisplayBounds(CGMainDisplayID()).height)
        if rect != frame {
            frame = rect
            film.setFrame(rect, display: true)
            controls.setFrame(NSRect(x: rect.maxX - 100, y: rect.maxY - 48, width: 84, height: 30), display: true)
        }
        if !visible {
            film.orderFrontRegardless()
            controls.orderFrontRegardless()
            movie.play()
            visible = true
        }
    }

    deinit {
        tokens.forEach(NotificationCenter.default.removeObserver)
        movie.pause()
        movie.replaceCurrentItem(with: nil)
        controls.close()
        film.close()
    }
}
