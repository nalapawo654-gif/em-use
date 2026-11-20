import AppKit

guard CommandLine.arguments.count == 3 else { exit(2) }
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let host = Host(media: URL(fileURLWithPath: CommandLine.arguments[1]), theme: CommandLine.arguments[2], bundleID: "com.openai.codex")
DispatchQueue.global().async {
    while let line = readLine() { DispatchQueue.main.async { host.command(line) } }
    DispatchQueue.main.async { NSApp.terminate(nil) }
}
host.tick()
app.run()
