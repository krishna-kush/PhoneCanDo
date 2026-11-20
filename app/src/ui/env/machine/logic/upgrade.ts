// Update system: the line that brings every package in the machine up to
// date with its package manager, typed into a terminal for you to run.
// Pure (zero RN imports): scripts/vectors/test_machine_page.js checks it.
import type { PackageFamily } from '../../../../engine/linux/types';

// Non-interactive where the manager asks, as lre's install lines are.
const UPGRADE: Record<PackageFamily, string> = {
  apt: 'apt-get update && apt-get upgrade -y',
  apk: 'apk update && apk upgrade',
  dnf: 'dnf upgrade -y',
  yum: 'yum update -y',
  microdnf: 'microdnf upgrade -y',
  pacman: 'pacman -Syu --noconfirm',
  zypper: 'zypper --non-interactive update',
  xbps: 'xbps-install -Syu',
};

/** Null when the machine has no package manager we know. */
export function upgradeCommand(family: PackageFamily | null | undefined): string | null {
  return family ? UPGRADE[family] : null;
}
