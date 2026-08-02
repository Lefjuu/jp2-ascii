# jpii

Jan Paweł II in your terminal — as colored ASCII.

Zero dependencies. Call it and he appears.

![jpii in the terminal](media/preview.png)

## Install

```bash
npm install jpii
```

## Usage

```js
const jpii = require('jpii')
jpii()
```

```js
import jpii from 'jpii'
jpii()
```

Needs a terminal with 24-bit color support.

The ANSI string is also available without printing:

```js
jpii.ascii          // CommonJS
import { ascii } from 'jpii'  // ESM
```

## Try locally

`example/` is a tiny consumer app with `jpii` installed via `file:..` (no `.gen` involved):

```bash
npm run example      # CommonJS
npm run example:esm  # ESM
```

Or:

```bash
cd example
npm install
npm start
```

## Regenerate

Source image + generator live in `.gen/` (not published). Rebuild:

```bash
npm run build
```

## License

MIT
