export type Language =
  | "javascript"
  | "typescript"
  | "json"
  | "css"
  | "scss"
  | "less"
  | "html"
  | "vue"
  | "angular"
  | "markdown"
  | "yaml"
  | "graphql"
  | "sql";

export const LANGUAGE_LABEL: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  json: "JSON",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  html: "HTML",
  vue: "Vue",
  angular: "Angular",
  markdown: "Markdown",
  yaml: "YAML",
  graphql: "GraphQL",
  sql: "SQL",
};

export const BEAUTIFY_LANGUAGES: Language[] = [
  "javascript",
  "typescript",
  "json",
  "css",
  "scss",
  "less",
  "html",
  "vue",
  "angular",
  "markdown",
  "yaml",
  "graphql",
  "sql",
];

export const MINIFY_LANGUAGES: Language[] = ["javascript", "typescript", "json", "css", "html"];

const EXT_TO_LANGUAGE: Record<string, Language> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "html",
  htm: "html",
  vue: "vue",
  md: "markdown",
  markdown: "markdown",
  yaml: "yaml",
  yml: "yaml",
  graphql: "graphql",
  gql: "graphql",
  sql: "sql",
};

export function detectFromFile(file: File): Language | null {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return EXT_TO_LANGUAGE[match[1]] ?? null;
}

export const LANGUAGE_EXT: Record<Language, string> = {
  javascript: "js",
  typescript: "ts",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  vue: "vue",
  angular: "html",
  markdown: "md",
  yaml: "yaml",
  graphql: "graphql",
  sql: "sql",
};

export const LANGUAGE_MIME: Record<Language, string> = {
  javascript: "text/javascript",
  typescript: "text/typescript",
  json: "application/json",
  css: "text/css",
  scss: "text/x-scss",
  less: "text/x-less",
  html: "text/html",
  vue: "text/x-vue",
  angular: "text/html",
  markdown: "text/markdown",
  yaml: "application/yaml",
  graphql: "application/graphql",
  sql: "text/x-sql",
};
