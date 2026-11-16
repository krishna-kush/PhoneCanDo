import { useState } from 'react';
import { Linking } from 'react-native';
import { AUTHOR } from '../copy';

/** Opens the author's page in the browser; when no app opens it, `msg` says the address to type. */
export function useAuthorLink(): { open: () => void; msg: string } {
  const [msg, setMsg] = useState('');
  const open = () => {
    setMsg('');
    Linking.openURL(AUTHOR.github).catch(() => setMsg(`Open ${AUTHOR.github} in a browser.`));
  };
  return { open, msg };
}
