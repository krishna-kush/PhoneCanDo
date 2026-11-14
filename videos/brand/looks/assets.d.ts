// What the bundler hands a picture for a file it imports: a stylesheet is
// applied to the page, a font file comes back as its URL.

declare module '*.css';

declare module '*.woff2' {
  const url: string;
  export default url;
}
