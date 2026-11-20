using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Threading;

namespace OpenSkin
{
    internal sealed class Program
    {
        readonly string media;
        string theme;
        readonly Dictionary<IntPtr,int> seen = new Dictionary<IntPtr,int>();
        readonly DispatcherTimer timer = new DispatcherTimer();
        DateTime replayUntil, pruneAt;
        IntPtr target;
        int targetPid;
        Playback playback;

        [STAThread]
        static int Main(string[] args)
        {
            if (args.Length != 2) return 2;
            var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
            var host = new Program(args[0], args[1]);
            var input = new Thread(() => {
                string line;
                while ((line = Console.ReadLine()) != null) {
                    string message = line;
                    app.Dispatcher.BeginInvoke(new Action(() => host.Command(message)));
                }
                app.Dispatcher.BeginInvoke(new Action(() => app.Shutdown()));
            }) { IsBackground = true };
            input.Start();
            app.Exit += (s,e) => { host.timer.Stop(); host.Stop(); };
            return app.Run();
        }

        Program(string media, string theme)
        {
            this.media = media;
            this.theme = theme;
            timer.Interval = TimeSpan.FromMilliseconds(300);
            timer.Tick += (s,e) => Tick();
            timer.Start();
        }

        void Stop()
        {
            replayUntil = DateTime.MinValue;
            playback?.Dispose();
            playback = null;
            timer.Interval = TimeSpan.FromMilliseconds(300);
        }

        void Command(string line)
        {
            switch (line) {
                case "dragon": case "emerald": theme = line; break;
                case "stop": Stop(); break;
                case "replay":
                    Stop();
                    var window = DesktopWindow.FindCodex();
                    if (window == IntPtr.Zero) { Console.WriteLine("missing"); return; }
                    replayUntil = DateTime.UtcNow.AddSeconds(15);
                    if (DesktopWindow.IsIconic(window)) DesktopWindow.ShowWindowAsync(window, 9);
                    DesktopWindow.SetForegroundWindow(window);
                    Tick();
                    break;
            }
        }

        void Tick()
        {
            // Ignore the Windows "animation effects" switch; EM Use's 轻柔模式 stops the helper instead.
            var now = DateTime.UtcNow;
            if (now >= pruneAt) {
                foreach (var item in seen.ToArray())
                    if (!DesktopWindow.IsWindow(item.Key) || DesktopWindow.ProcessId(item.Key) != item.Value)
                        seen.Remove(item.Key);
                pruneAt = now.AddSeconds(2);
            }
            if (replayUntil != DateTime.MinValue && now >= replayUntil) {
                replayUntil = DateTime.MinValue;
                Console.WriteLine("missing");
            }
            var front = DesktopWindow.GetForegroundWindow();
            int pid = DesktopWindow.ProcessId(front);
            if (playback != null) {
                if (!DesktopWindow.IsWindow(target) || DesktopWindow.ProcessId(target) != targetPid) Stop();
                else if (front == target || !DesktopWindow.IsCodex(front, pid) || seen.ContainsKey(front)) {
                    playback.Update(target, front == target);
                    timer.Interval = TimeSpan.FromMilliseconds(front == target && playback != null ? 33 : 300);
                    return;
                } else Stop();
            }
            bool manual = replayUntil != DateTime.MinValue;
            if ((!manual && seen.TryGetValue(front, out var previous) && previous == pid) ||
                !DesktopWindow.IsCodex(front, pid) || DesktopWindow.IsIconic(front)) return;
            replayUntil = DateTime.MinValue;
            seen[front] = pid;
            target = front;
            targetPid = pid;
            playback = new Playback(front, Path.Combine(media, theme + ".mp4"), Stop, message => {
                Stop(); Console.WriteLine(message);
            });
            Console.WriteLine("playing");
            playback.Update(front, true);
            timer.Interval = TimeSpan.FromMilliseconds(33);
        }
    }
}
