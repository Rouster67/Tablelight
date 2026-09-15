/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { execFileSync } = require('node:child_process');
// Inspect the region actually applied by Windows, not just the renderer's report.
module.exports = function nativeInput(win, points) {
  const width = win.getBounds().width;
  const coordinates = JSON.stringify(points.map((p) => ({ x: Number(p.x), y: Number(p.y) })));
  const handle = win.getNativeWindowHandle().readBigUInt64LE();
  const source = `using System; using System.Runtime.InteropServices;
    public class TLMessageRegion {
      [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left, top, right, bottom; }
      [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
      [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr win, out Rect rect);
      [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr win, IntPtr region);
      [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr win, int index);
      [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
      [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr region,int x,int y);
      [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr region);
    }`;
  const command = `Add-Type -TypeDefinition '${source}';
    [void][TLMessageRegion]::SetProcessDPIAware();
    $windowRect = New-Object TLMessageRegion+Rect;
    [void][TLMessageRegion]::GetWindowRect([IntPtr]${handle},[ref]$windowRect);
    $factor = ($windowRect.right - $windowRect.left) / ${width};
    $messageRegion = [TLMessageRegion]::CreateRectRgn(0,0,0,0);
    try {
      $kind = [TLMessageRegion]::GetWindowRgn([IntPtr]${handle},$messageRegion);
      $points = ConvertFrom-Json '${coordinates}';
      $hits = @($points | ForEach-Object { [TLMessageRegion]::PtInRegion($messageRegion,[int]($_.x*$factor),[int]($_.y*$factor)) });
      @{kind=$kind; hits=$hits; transparent=(([TLMessageRegion]::GetWindowLongPtr([IntPtr]${handle},-20).ToInt64() -band 32) -ne 0)} | ConvertTo-Json -Compress;
    } finally { [void][TLMessageRegion]::DeleteObject($messageRegion); }`;
  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
    }).trim()
  );
};
