import stylistic from "@stylistic/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            parser: typescriptParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            },
            sourceType: "module"
        },
        plugins: {
            "@stylistic": stylistic
        },
        rules: {
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/comma-dangle": ["error", "never"],
            "@stylistic/indent": ["error", 4, { SwitchCase: 1 }],
            "@stylistic/jsx-indent-props": ["error", 4],
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/quotes": ["error", "single", { avoidEscape: true }],
            "@stylistic/semi": ["error", "always"]
        }
    }
];