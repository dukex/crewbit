# [1.5.0](https://github.com/dukex/crewbit/compare/v1.4.0...v1.5.0) (2026-04-04)


### Features

* add OpenCode runner support ([615b129](https://github.com/dukex/crewbit/commit/615b1294623dc89ee247602e98d504e164add24b))

# [1.4.0](https://github.com/dukex/crewbit/compare/v1.3.0...v1.4.0) (2026-03-30)


### Features

* support custom prompt templates per transition ([bf94458](https://github.com/dukex/crewbit/commit/bf944589abfc8d6aa3060d45bab7d2598adebbe8))

# [1.3.0](https://github.com/dukex/crewbit/compare/v1.2.0...v1.3.0) (2026-03-30)


### Features

* **Jira:** configurable sort field for issue queries ([af220e5](https://github.com/dukex/crewbit/commit/af220e5fc53442951ada7407cedc5c9e27177c19))

# [1.2.0](https://github.com/dukex/crewbit/compare/v1.1.0...v1.2.0) (2026-03-30)


### Features

* add prune subcommand to remove stale worktrees and branches ([3560e7f](https://github.com/dukex/crewbit/commit/3560e7f8cd15dbb6e4b6aabcc2d923380b7a6a78))

# [1.1.0](https://github.com/dukex/crewbit/compare/v1.0.3...v1.1.0) (2026-03-29)


### Bug Fixes

* add .nojekyll to dist so peaceiris can copy dotfiles without aborting ([119cdb1](https://github.com/dukex/crewbit/commit/119cdb137ce2adceb14ef950b3f9404f8e0c01e4))
* make project board status transitions explicit in /develop command ([984f4e9](https://github.com/dukex/crewbit/commit/984f4e9c7da156f02aad390e1475fa7b3769b209))
* now crewbit works with GitHub user accounts, not only organizations ([2db8507](https://github.com/dukex/crewbit/commit/2db8507ee90692548fc10d01f5176377f9424fac))
* prevent docs deployment when build output is missing ([eaac5dd](https://github.com/dukex/crewbit/commit/eaac5dd1174e38cc5921ca8f16dd7546b977f614))
* remove duplicate pnpm version from docs workflow ([ca78d29](https://github.com/dukex/crewbit/commit/ca78d29290dc46996c521740986bcf3e3caceab3))
* repo root now resolves to the directory where crewbit is invoked ([e2d72ba](https://github.com/dukex/crewbit/commit/e2d72ba4fe6f92f4c1bb32ec3ecb8adbf045069d))
* restore vitepress config with correct base, nav and sidebar ([5a85e7f](https://github.com/dukex/crewbit/commit/5a85e7f27470da6ab5001b1182c41f1fe672e8a5))


### Features

* add /develop slash command for implementing GitHub issues ([5024fe9](https://github.com/dukex/crewbit/commit/5024fe98ad183f4cf31404891e2676d7be33ea39))
* add dark minimal theme with violet accent ([d9429c9](https://github.com/dukex/crewbit/commit/d9429c97ae3ed57890ebeff5f0945b1caa8b63af))
* launch VitePress docs portal with GitHub Pages deployment ([#13](https://github.com/dukex/crewbit/issues/13)) ([330a049](https://github.com/dukex/crewbit/commit/330a049757cc7971217a68d912e8ec828e211024))
* now crewbit can pick up issues from GitHub Projects v2 ([ddeae28](https://github.com/dukex/crewbit/commit/ddeae28d82003e3498befc3d0e481f03d86d2e70))

## [1.0.3](https://github.com/dukex/crewbit/compare/v1.0.2...v1.0.3) (2026-03-29)


### Bug Fixes

* replace deprecated macos-13 runner with macos-latest for darwin-x64 build ([33cb4d4](https://github.com/dukex/crewbit/commit/33cb4d4291f1497f82aebe666b5d8869d7a91a6d))
* resolve all build job failures in release workflow ([a12089d](https://github.com/dukex/crewbit/commit/a12089d8bccfb471c580217d17f221e8b79ccf50))

## [1.0.2](https://github.com/dukex/crewbit/compare/v1.0.1...v1.0.2) (2026-03-29)


### Bug Fixes

* build artifacts now correctly attached to each release ([bdeb19c](https://github.com/dukex/crewbit/commit/bdeb19ca65cd5f8c2988e09ff219dcf9dadcd1ec))

## [1.0.1](https://github.com/dukex/crewbit/compare/v1.0.0...v1.0.1) (2026-03-29)


### Bug Fixes

* rename install script ([d81ea1b](https://github.com/dukex/crewbit/commit/d81ea1b6ae7efae935bba7967f444a60755ae906))

# 1.0.0 (2026-03-29)

Initial version
