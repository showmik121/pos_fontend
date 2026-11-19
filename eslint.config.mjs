import { FlatCompat } from "@eslint/eslintrc"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const config = [
  { ignores: [".next/**", "out/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "public/sw.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `_` দিয়ে শুরু করা নাম ইচ্ছাকৃত অব্যবহৃত (যেমন ডিস্ট্রাকচারে বাদ দেওয়া ফিল্ড)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
]

export default config
