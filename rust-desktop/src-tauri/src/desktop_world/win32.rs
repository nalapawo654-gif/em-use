//! Windows shell integration. Never hide/reparent an Explorer window or change the saved wallpaper.
use ::windows::{
    core::w,
    Win32::{
        Foundation::{HWND, LPARAM, POINT, WPARAM},
        Graphics::Gdi::ScreenToClient,
        UI::WindowsAndMessaging::*,
    },
};

#[derive(Clone, Copy)]
pub struct Desktop {
    pub parent: isize,
    shell: isize,
    icons: isize,
    process: u32,
}
fn hwnd(value: isize) -> HWND {
    HWND(value as *mut std::ffi::c_void)
}

struct Search {
    parent: HWND,
    icons: HWND,
}
unsafe extern "system" fn find_icons(window: HWND, data: LPARAM) -> ::windows::core::BOOL {
    let search = &mut *(data.0 as *mut Search);
    if FindWindowExW(Some(window), None, w!("SHELLDLL_DefView"), None).is_ok() {
        if let Ok(worker) = FindWindowExW(None, Some(window), w!("WorkerW"), None) {
            // Never attach to the window containing the icon list itself.
            if FindWindowExW(Some(worker), None, w!("SHELLDLL_DefView"), None).is_err() {
                search.parent = worker;
                search.icons = window;
            }
        }
    }
    true.into()
}

pub fn discover() -> Result<Desktop, String> {
    unsafe {
        let shell = FindWindowW(w!("Progman"), None)
            .map_err(|_| "未找到 Windows 桌面，请启动资源管理器后重试")?;
        // Undocumented shell message used by wallpaper hosts. Bound the wait for a hung Explorer.
        SendMessageTimeoutW(
            shell,
            0x052c,
            WPARAM(0x0d),
            LPARAM(1),
            SMTO_ABORTIFHUNG,
            1000,
            None,
        );
        let mut search = Search {
            parent: HWND::default(),
            icons: HWND::default(),
        };
        EnumWindows(Some(find_icons), LPARAM(&mut search as *mut _ as isize))
            .map_err(|_| "无法读取 Windows 桌面层")?;
        // Newer Windows 11 shells keep the wallpaper WorkerW under Progman.
        if FindWindowExW(Some(shell), None, w!("SHELLDLL_DefView"), None).is_ok() {
            if let Ok(worker) = FindWindowExW(Some(shell), None, w!("WorkerW"), None) {
                search.parent = worker;
                search.icons = shell;
            }
        }
        if search.parent.0.is_null() || !IsWindowVisible(search.parent).as_bool() {
            return Err("当前 Windows 桌面层不可用，请重新加载河床；未修改系统壁纸".into());
        }
        let mut process = 0;
        GetWindowThreadProcessId(search.parent, Some(&mut process));
        Ok(Desktop {
            parent: search.parent.0 as isize,
            shell: shell.0 as isize,
            icons: search.icons.0 as isize,
            process,
        })
    }
}

pub fn valid(desktop: Desktop, child: isize) -> bool {
    unsafe {
        let parent = hwnd(desktop.parent);
        let mut process = 0;
        GetWindowThreadProcessId(parent, Some(&mut process));
        IsWindow(Some(parent)).as_bool()
            && IsWindow(Some(hwnd(child))).as_bool()
            && process == desktop.process
            && GetParent(hwnd(child)).ok() == Some(parent)
    }
}

pub fn place(desktop: Desktop, child: isize, rect: [i32; 4]) -> Result<(), String> {
    unsafe {
        let parent = hwnd(desktop.parent);
        if GetParent(hwnd(child)).ok() != Some(parent) {
            return Err("河床未能附着到桌面层".into());
        }
        let mut origin = POINT {
            x: rect[0],
            y: rect[1],
        };
        if !ScreenToClient(parent, &mut origin).as_bool() {
            return Err("无法计算桌面坐标".into());
        }
        SetWindowPos(
            hwnd(child),
            Some(HWND_TOP),
            origin.x,
            origin.y,
            rect[2],
            rect[3],
            SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|_| "无法调整河床壁纸大小".to_string())
    }
}

pub fn pointer(desktop: Desktop, rect: [i32; 4]) -> Option<[f64; 2]> {
    unsafe {
        let mut point = POINT::default();
        GetPhysicalCursorPos(&mut point).ok()?;
        let hit = GetAncestor(WindowFromPoint(point), GA_ROOT);
        // Do not react to movement over another app, the taskbar, or the pet.
        if ![desktop.shell, desktop.icons, desktop.parent].contains(&(hit.0 as isize)) {
            return None;
        }
        super::normalized_pointer(rect, [point.x, point.y])
    }
}
