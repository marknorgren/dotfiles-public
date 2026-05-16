# macOS settings

BLUF: `just macos-review` previews the macOS defaults in this repo.
`just setup-macos` applies them through `.macos`. Read this before running the
script on a new Mac or after a macOS upgrade.

Checked on 2026-05-16 against Apple macOS Tahoe 26.5 docs. Local command and
preference checks were run on macOS 26.4.1. Apple documents the System Settings
UI, not every `defaults` key, so key-level validation is partly empirical.

## Commands

```bash
just macos-review
just setup-macos
```

`macos-review` runs `.macos --dry-run` and prints each command without changing
preferences.

`setup-macos` runs `.macos`, writes per-user preferences, then restarts Dock,
Finder, SystemUIServer, and `cfprefsd`.

## Scope

This script only writes per-user preferences. It does not configure FileVault,
screensaver security, power management, SSD settings, memory settings, or
private app preferences.

The script intentionally avoids `sudo`, System Settings cache deletion, and
legacy System Preferences automation.

## Setting reference

| Area       | Key                                                                          | Value             | Effect                                                     | macOS 26.5 status                                                            |
| ---------- | ---------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Filesystem | `~/Documents/Books`                                                          | directory exists  | Creates a local Books directory.                           | Still relevant. User convenience only.                                       |
| Region     | `NSGlobalDomain AppleLocale`                                                 | `en_US`           | Uses US regional formatting.                               | Still relevant. Apple still exposes Region in Language & Region.             |
| Region     | `NSGlobalDomain AppleMeasurementUnits`                                       | `Inches`          | Uses US measurement labels.                                | Still relevant. Apple still exposes Measurement system.                      |
| Region     | `NSGlobalDomain AppleMetricUnits`                                            | `false`           | Keeps non-metric defaults.                                 | Still relevant. Paired with Measurement system.                              |
| Region     | `NSGlobalDomain AppleTemperatureUnit`                                        | `Fahrenheit`      | Uses Fahrenheit in system formats.                         | Still relevant. Apple still exposes Temperature.                             |
| Region     | `NSGlobalDomain AppleICUDateFormatStrings[1]`                                | `M/d/yy`          | Sets short date format.                                    | Still relevant, but this is a direct ICU override.                           |
| Region     | `NSGlobalDomain AppleICUDateFormatStrings[2]`                                | `MMM d, y`        | Sets medium date format.                                   | Still relevant, but this is a direct ICU override.                           |
| Region     | `NSGlobalDomain AppleICUDateFormatStrings[3]`                                | `MMMM d, y`       | Sets long date format.                                     | Still relevant, but this is a direct ICU override.                           |
| Region     | `NSGlobalDomain AppleICUDateFormatStrings[4]`                                | `EEEE, MMMM d, y` | Sets full date format.                                     | Still relevant, but this is a direct ICU override.                           |
| Pointer    | `NSGlobalDomain com.apple.mouse.scaling`                                     | `2.1`             | Sets mouse tracking speed.                                 | Still relevant. Apple still exposes mouse tracking speed.                    |
| Pointer    | `NSGlobalDomain com.apple.trackpad.scaling`                                  | `2.1`             | Sets trackpad tracking speed.                              | Still relevant. Apple still exposes trackpad tracking speed.                 |
| Appearance | `NSGlobalDomain AppleInterfaceStyle`                                         | `Dark`            | Uses dark appearance.                                      | Still relevant. Apple still exposes Dark appearance.                         |
| Trackpad   | `com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking`                | `true`            | Enables tap to click for Bluetooth trackpads.              | Still relevant for compatible trackpads.                                     |
| Trackpad   | `com.apple.AppleMultitouchTrackpad Clicking`                                 | `true`            | Enables tap to click for built-in trackpads.               | Still relevant for compatible trackpads.                                     |
| Trackpad   | `com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag`                  | `true`            | Enables three-finger drag for built-in trackpads.          | Still relevant. Apple documents three-finger drag in Accessibility.          |
| Trackpad   | `com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadThreeFingerDrag` | `true`            | Enables three-finger drag for Bluetooth trackpads.         | Still relevant for compatible trackpads.                                     |
| Menu bar   | `com.apple.controlcenter BatteryShowPercentage`                              | `true`            | Shows percentage text for the battery menu bar item.       | Still relevant. Apple still documents Show Percentage.                       |
| Menu bar   | `com.apple.controlcenter NSStatusItem Visible Battery`                       | `true`            | Shows the battery item in the menu bar.                    | Still relevant. Apple now separates showing Battery from showing percentage. |
| Finder     | `NSGlobalDomain AppleShowAllExtensions`                                      | `true`            | Shows all filename extensions.                             | Still relevant. Apple still exposes this Finder setting.                     |
| Finder     | `com.apple.finder ShowPathbar`                                               | `true`            | Shows the Finder path bar.                                 | Still relevant.                                                              |
| Finder     | `com.apple.finder ShowStatusBar`                                             | `true`            | Shows the Finder status bar.                               | Still relevant.                                                              |
| Finder     | `com.apple.finder _FXSortFoldersFirst`                                       | `true`            | Keeps folders on top when sorting by name.                 | Still relevant. Apple still exposes this Finder setting.                     |
| Finder     | `com.apple.desktopservices DSDontWriteNetworkStores`                         | `true`            | Prevents Finder `.DS_Store` writes on network volumes.     | Still relevant. Apple documents the network-volume default.                  |
| Finder     | `com.apple.desktopservices DSDontWriteUSBStores`                             | `true`            | Prevents Finder `.DS_Store` writes on USB volumes.         | Useful, but less directly documented by Apple than the network setting.      |
| Finder     | `com.apple.finder AppleShowAllFiles`                                         | `true`            | Shows hidden files in Finder.                              | Still works. No current System Settings toggle.                              |
| Finder     | `com.apple.finder FXPreferredViewStyle`                                      | `Nlsv`            | Uses list view for new Finder windows.                     | Still works. Finder still supports list view.                                |
| Dock       | `com.apple.dock autohide`                                                    | `true`            | Automatically hides the Dock.                              | Still relevant. Apple still documents Dock hiding.                           |
| Dock       | `com.apple.dock autohide-delay`                                              | `0`               | Removes the delay before showing the hidden Dock.          | Still works. No System Settings control.                                     |
| Dock       | `com.apple.dock autohide-time-modifier`                                      | `0.5`             | Speeds up Dock show/hide animation.                        | Still works. No System Settings control.                                     |
| Dock       | `com.apple.dock show-recents`                                                | `false`           | Hides suggested and recent apps in the Dock.               | Still relevant. Apple still exposes this Dock setting.                       |
| Keyboard   | `NSGlobalDomain KeyRepeat`                                                   | `2`               | Sets a fast key repeat rate.                               | Still relevant. Apple still exposes Key repeat rate.                         |
| Keyboard   | `NSGlobalDomain InitialKeyRepeat`                                            | `15`              | Sets a short delay before key repeat.                      | Still relevant. Apple still exposes Delay until repeat.                      |
| Keyboard   | `NSGlobalDomain NSAutomaticCapitalizationEnabled`                            | `false`           | Disables automatic capitalization.                         | Still relevant. Apple still exposes this input-source setting.               |
| Keyboard   | `NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled`                        | `false`           | Disables double-space period substitution.                 | Still relevant. Apple still exposes this input-source setting.               |
| Keyboard   | `NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled`                         | `false`           | Disables smart quote substitution.                         | Still relevant. Apple still exposes this input-source setting.               |
| Keyboard   | `NSGlobalDomain NSAutomaticSpellingCorrectionEnabled`                        | `false`           | Disables automatic spelling correction.                    | Still relevant. Apple still exposes this input-source setting.               |
| Keyboard   | `NSGlobalDomain ApplePressAndHoldEnabled`                                    | `false`           | Uses key repeat instead of press-and-hold accent popovers. | Still relevant for repeat-heavy typing workflows.                            |
| UI         | `NSGlobalDomain AppleShowScrollBars`                                         | `Always`          | Always shows scrollbars.                                   | Still relevant. Apple still exposes scrollbar behavior in Appearance.        |

## Restarted processes

`.macos` restarts these processes after applying settings:

| Process          | Why                                                |
| ---------------- | -------------------------------------------------- |
| `Dock`           | Reloads Dock preferences.                          |
| `Finder`         | Reloads Finder preferences.                        |
| `SystemUIServer` | Reloads menu bar status items.                     |
| `cfprefsd`       | Flushes preference cache so new defaults are read. |

## Validation sources

- Apple Developer:
  [macOS Tahoe 26.5 release notes](https://developer.apple.com/documentation/macos-release-notes/macos-26_5-release-notes)
- Apple Support:
  [Language & Region settings](https://support.apple.com/guide/mac-help/change-language-region-settings-on-mac-intl163/mac)
- Apple Support:
  [Mouse and trackpad tracking speed](https://support.apple.com/guide/mac-help/change-your-mouse-or-trackpads-response-speed-mchlp1138/mac)
- Apple Support:
  [Use a light or dark appearance](https://support.apple.com/en-om/guide/mac-help/mchl52e1c2d2)
- Apple Support: [Multi-Touch gestures](https://support.apple.com/en-is/102482)
- Apple Support: [Three-finger drag](https://support.apple.com/en-us/102341)
- Apple Support:
  [Battery percentage in the menu bar](https://support.apple.com/en-euro/guide/mac-help/-mchlp1115/mac)
- Apple Support:
  [Finder settings](https://support.apple.com/guide/mac-help/change-finder-settings-on-mac-mchlp2803/mac)
- Apple Support:
  [SMB browsing and `.DS_Store`](https://support.apple.com/en-au/102064)
- Apple Support: [Use the Dock](https://support.apple.com/kb/HT2474)
- Apple Support:
  [Recent apps in the Dock](https://support.apple.com/en-asia/guide/mac-help/open-recently-used-items-on-mac-mchlp2724/mac)
- Apple Support:
  [Keyboard settings](https://support.apple.com/guide/mac-help/-kbdm162/mac)
- Apple Support:
  [Input Sources settings](https://support.apple.com/guide/mac-help/change-input-sources-settings-mchl84525d76/26/mac/26)
