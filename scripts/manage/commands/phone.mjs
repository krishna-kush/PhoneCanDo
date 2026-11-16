// apk and device: what an APK file is, and getting one onto the phone.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { buildTools } from '../env.mjs';
import { die } from '../errors.mjs';
import { capture, sh } from '../run.mjs';

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

export function apk(args) {
  if (args.length < 2 || args[0] !== 'info') die('usage: manage apk info <file.apk>');
  const file = args[1];
  if (!isFile(file)) die(`no such file: ${file}`);
  const tools = buildTools();
  const aapt = join(tools, 'aapt');
  const badging = capture([aapt, 'dump', 'badging', file]);
  const pkg = badging.split('\n').find((line) => line.startsWith('package:')) ?? 'package: ?';
  const manifest = capture([aapt, 'dump', 'xmltree', file, 'AndroidManifest.xml']);
  const channel = manifest.match(/com\.phonecando\.channel.*?\n.*?android:value.*?"([a-z]+)"/s);
  const certs = capture([join(tools, 'apksigner'), 'verify', '--print-certs', file]);
  const signer = certs.split('\n').find((line) => line.includes('SHA-256'))?.trim() ?? 'signer: ?';
  console.log(pkg);
  console.log(`channel: ${channel ? channel[1] : '?'}`);
  console.log(`accessibility service: ${manifest.includes('BIND_ACCESSIBILITY_SERVICE') ? 'yes' : 'no'}`);
  console.log(`size: ${statSync(file).size} bytes`);
  console.log(signer);
}

export function device(args) {
  const usage = 'usage: manage device push <file.apk> | log';
  if (args[0] === 'push') {
    if (!isFile(args[1] ?? '')) die('usage: manage device push <file.apk>');
    sh(['adb', 'shell', 'mkdir', '-p', '/sdcard/Download/phonecando']);
    sh(['adb', 'push', args[1], '/sdcard/Download/phonecando/']);
    console.log('Open it from Files → Downloads → phonecando on the phone (not adb install).');
  } else if (args[0] === 'log') {
    sh(['adb', 'logcat', '-c']);
    sh(['adb', 'logcat', '-v', 'time', '-s', 'phonecando-update', 'ReactNativeJS:I', 'PackageInstaller:V', 'PackageManager:I', 'Finsky:I']);
  } else {
    die(usage);
  }
}
