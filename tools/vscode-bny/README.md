# BNY Language Support

VS Code syntax highlighting, snippets, and editor support for BunNarraY (`.bny`) dialogue files.

Included:

- Full-line and inline `#` comments.
- Labels, gotos, skip blocks, branches, and choice blocks.
- Option conditions (`[when:identifier=value]` or `[unless:identifier=value]`) and IDs (`[id:name]`) in either order.
- `:SET` assignments and deletion, `:SIGNAL`, `:YIELD`, `:SPEAKER`, and `:ALTERNATE`.
- Speaker shorthand (`|name|` and `||`), including dialogue on the same line.
- `$variables` in dialogue and `:SET` values. Speaker names also interpolate at runtime, though the extension styles them as speaker text. Option text, IDs, conditions, and signal/yield values are literal strings.
- Text escapes: `&lbrack;`, `&rbrack;`, `&lbrace;`, `&rbrace;`, `&hash;`, `&pipe;`, and `&amp;`.
- Bracket matching, auto-closing, and surrounding for `{}` and `[]`.
- `.bny` file association.

Snippet prefixes: `choice`, `option-when`, `option-unless`, `option-id`, `branch`, `when`, `unless`, `skip`, `set`, `unset`, `speaker`, `speaker-inline`, `alternate`, `signal`, `yield`, `label`, and `goto`.

See the [language guide](../../doc/language.md) and [feature tour](../../examples/feature-tour.bny) for syntax and runtime behavior.

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
