# jp2-ascii

Jan Paweł II in your terminal — as colored ASCII.

Zero dependencies. Call it and he appears.

![jp2-ascii in the terminal](media/preview.png)

## Install

```bash
npm install jp2-ascii
```

## Usage

```js
const jpii = require('jp2-ascii')
jpii()
```

```js
import jpii from 'jp2-ascii'
jpii()
```

Needs a terminal with 24-bit color support.

The ANSI string is also available without printing:

```js
jpii.ascii                 // CommonJS
import { ascii } from 'jp2-ascii'  // ESM
```

## Try locally

`example/` is a tiny consumer app with `jp2-ascii` installed via `file:..` (no `.gen` involved):

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

ASCII is rebuilt locally from a private `.gen/` folder (not in git / not on npm):

```bash
npm run build
```

## License

MIT
