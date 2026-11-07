// What linuxStatus() returns (LinuxStatus.kt): whether this build can run
// Linux images, and the native-lib paths it would use.
export type LinuxStatus = {
  available: boolean;
  // Empty when available; otherwise why not (play channel, missing files).
  reason: string;
  // applicationInfo.nativeLibraryDir: the only place Android lets us exec from.
  libDir: string;
  // libphonecando_launch.so: the multi-call launcher the shims link to.
  launcher: string;
  // libproot.so and libproot-loader.so.
  proot: string;
  loader: string;
};
