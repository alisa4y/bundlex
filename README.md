# bundleX

a very fast and scalable bundler with bunch of features

# bundler

`jsBundler` is the function to bundle js or ts just by passing the path to the file.

# listener

You can listen for events hapenning on the bundled path.

With `jsBundler.on` you can listen for events hapenning on the bundled path.

For example if you want to listen for the `change` event you can do:

```
jsBundler.on('change', (path: string) => {
  // something to do
})
```

# Features

Out of the box supports typescript and json files.

You can create your own bundler to handle any kind of bundling.

With `createBundler` you can create your own bundler just by providing a info extractor function and bundler function

```
type InfoExtractor = (path: string) => Promise<{
  imports: string[]
  path: string
  content: string
}>
type Bundler = (contents: Info[]) => string
```
