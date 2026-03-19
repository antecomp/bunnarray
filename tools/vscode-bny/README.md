# BNY Language Support

Minimal VS Code language support for `.bny` dialogue files.

Included:

- syntax highlighting for comments, labels, gotos, option markers, skip blocks, match blocks, match cases, braces, directives, and `$variables`
- bracket matching and auto-closing for `{}` and `<>`
- `.bny` file association

## Use it locally

1. Open VS Code.
2. Run `Extensions: Install from VSIX...` if you package it first, or `Developer: Install Extension from Location...` if your VS Code build supports that command.
3. Point it at this folder:

```text
tools/vscode-bny
```

For extension development, you can also open this folder directly in VS Code and press `F5` to launch an Extension Development Host.
