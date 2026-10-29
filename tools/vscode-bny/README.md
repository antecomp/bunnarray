# BNY Language Support

VS Code syntax highlighting, snippets, and editor support for current `.bny` dialogue files. This extension is declarative: it does not provide compiler diagnostics, execution, or label navigation.

Included:

- Full-line and inline `#` comments.
- Labels, gotos, skip blocks, branches, and choice blocks.
- Option conditions (`[when:identifier=value]`) and IDs (`[id:name]`) in either order.
- `:SET` assignments and deletion, `:SIGNAL`, `:YIELD`, `:SPEAKER`, and `:ALTERNATE`.
- Speaker shorthand (`|name|` and `||`), including dialogue on the same line.
- `$variables` in dialogue and `:SET` values. Option text, IDs, conditions, speaker names, and signal/yield values are literal strings.
- Text escapes: `&lbrack;`, `&rbrack;`, `&lbrace;`, `&rbrace;`, `&hash;`, `&pipe;`, and `&amp;`.
- Bracket matching, auto-closing, and surrounding for `{}` and `[]`.
- `.bny` file association.

Snippet prefixes: `choice`, `option-when`, `option-id`, `branch`, `when`, `skip`, `set`, `unset`, `speaker`, `speaker-inline`, `alternate`, `signal`, `yield`, `label`, and `goto`.

See the [language guide](../../doc/language.md) and [feature tour](../../examples/feature-tour.bny) for syntax and runtime behavior.

## Changes in 2.1.0

Legacy angle-bracket tags such as `<face:thinking>` and `<signal:keygiven>` no longer receive directive highlighting, and `<` no longer auto-closes. The compiler treats these tags as ordinary dialogue text. Use `:SIGNAL keygiven` to emit a signal, or `:YIELD identifier` to pause for a consumer action. There is no built-in face-change directive; consumers can implement one using signals or yields.

## Use it locally

Install a packaged VSIX using `Extensions: Install from VSIX...`, or use `Developer: Install Extension from Location...` if your VS Code build provides it, pointing to `tools/vscode-bny`.

To run an Extension Development Host from a terminal:

```sh
code --extensionDevelopmentPath="$PWD/tools/vscode-bny"
```

Optional settings to prioritize snippets and reduce word completion noise:

```json
{
  "[bny]": {
    "editor.snippetSuggestions": "top",
    "editor.suggestSelection": "first",
    "editor.tabCompletion": "onlySnippets",
    "editor.wordBasedSuggestions": "off"
  }
}
```
