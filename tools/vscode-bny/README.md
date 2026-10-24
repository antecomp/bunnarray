# BNY Language Support

Minimal VS Code language support for `.bny` dialogue files.

Included:

- syntax highlighting for comments, labels, gotos, option markers, skip blocks, branch blocks, branch cases, braces, directives, and `$variables`
- bracket matching and auto-closing for `{}` and `<>`
- snippets for `branch` and `skip`
- `.bny` file association

## Use it locally

1. Open VS Code.
2. Run `Extensions: Install from VSIX...` if you package it first, or `Developer: Install Extension from Location...` if your VS Code build supports that command.
3. Point it at this folder:

```text
tools/vscode-bny
```

For extension development, you can also open this folder directly in VS Code and press `F5` to launch an Extension Development Host.

As a suggestion, you should also add this to your settings.json to reduce autocomplete noise:
```
{
  "[bny]": {
    "editor.snippetSuggestions": "top",
    "editor.suggestSelection": "first",
    "editor.tabCompletion": "onlySnippets",
    "editor.wordBasedSuggestions": "off"
  }
}
```
