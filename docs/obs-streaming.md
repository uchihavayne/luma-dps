# OBS browser source

The stream panel starts a local read-only source when you choose **Start OBS source**. Add its URL as an OBS Browser Source. Stopping the source or closing Luma immediately removes the listener. Starting it again creates a different 128-bit random key, so old links stop working. The source is off at startup and never starts packet capture by itself.

Choose personal, confirmed party, or observed-player scope. Personal and party views stay unknown until the corresponding identity is known. Names are hidden by default; hidden-name output contains aliases instead of player IDs, names, target names, build data, connection addresses, or raw capture metadata. Changing the scope or name setting requires applying the source settings again.

## A second computer on the same LAN

Enable **Allow another PC on my private LAN** explicitly. Luma then binds the listener to IPv4 interfaces and lists up to eight current private IPv4 addresses for the gaming PC. Copy the URL for the interface reachable from the streaming PC. Local OBS on the gaming PC can continue to use the loopback URL. An automatic port is selected unless a port from 1024–65535 is requested.

The source accepts loopback and private IPv4 clients only. Requests must use one of the exact local numeric addresses and the current key. Only the overlay page, its two packaged assets, and its state endpoint are served. There is no remote settings API, file server, capture endpoint, cross-origin access, or name/scope override in the URL.

Treat the URL as a secret: its key grants access to the selected live stream data while the source runs. Luma does not write this URL to logs, public reports, or diagnostics. The LAN source uses plain HTTP inside the local network; it is intended for a trusted private LAN. It does not open a router port, configure UPnP, change Windows Firewall, or enable itself automatically. If Windows asks about network access, allow only the private network you intend to use. If the PC address changes, restart the source and copy its new URL.

## Global shortcuts

Windows shortcuts use `RegisterHotKey`, without a keyboard hook, game input interception, or extra installer. Defaults use Ctrl+Alt+Shift plus F7 (show/hide), F8 (lock/unlock), F9 (pause), F10 (new encounter), F11 (settings), and F6 (copy summary). The unlock shortcut remains available when the meter is locked. Shortcuts can be changed or disabled in settings. At least two modifiers are required; Windows-key combinations and F12 are reserved and unavailable.

If another program owns a shortcut, the previous set of shortcuts is restored and the conflict is shown. Changes take effect immediately. Closing Luma unregisters the shortcuts.

Native API references: [RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey), [WM_HOTKEY](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-hotkey), [GetIpAddrTable](https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getipaddrtable).
