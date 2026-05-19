// Beautify dispatch. prettier handles most languages via lazily-loaded plugins.
// SQL goes through sql-formatter — prettier's SQL support is plugin-only and
// less capable than the dedicated tool.

import type { Plugin } from "prettier";
import type { Language } from "./languages";

export interface BeautifyOptions {
  indent?: number;
  printWidth?: number;
  sqlDialect?: string;
}

// Map our internal language IDs to prettier parser names + the plugin file(s)
// they require.
const PRETTIER_PARSERS: Record<Exclude<Language, "sql">, { parser: string; plugins: string[] }> = {
  javascript: { parser: "babel", plugins: ["babel", "estree"] },
  typescript: { parser: "typescript", plugins: ["typescript", "estree"] },
  json: { parser: "json", plugins: ["babel", "estree"] },
  css: { parser: "css", plugins: ["postcss"] },
  scss: { parser: "scss", plugins: ["postcss"] },
  less: { parser: "less", plugins: ["postcss"] },
  html: { parser: "html", plugins: ["html"] },
  vue: { parser: "vue", plugins: ["html"] },
  angular: { parser: "angular", plugins: ["html", "angular"] },
  markdown: { parser: "markdown", plugins: ["markdown"] },
  yaml: { parser: "yaml", plugins: ["yaml"] },
  graphql: { parser: "graphql", plugins: ["graphql"] },
};

async function loadPrettierPlugin(name: string): Promise<Plugin> {
  switch (name) {
    case "babel":
      return (await import("prettier/plugins/babel")).default as Plugin;
    case "estree":
      return (await import("prettier/plugins/estree")).default as Plugin;
    case "typescript":
      return (await import("prettier/plugins/typescript")).default as Plugin;
    case "postcss":
      return (await import("prettier/plugins/postcss")).default as Plugin;
    case "html":
      return (await import("prettier/plugins/html")).default as Plugin;
    case "angular":
      return (await import("prettier/plugins/angular")).default as Plugin;
    case "markdown":
      return (await import("prettier/plugins/markdown")).default as Plugin;
    case "yaml":
      return (await import("prettier/plugins/yaml")).default as Plugin;
    case "graphql":
      return (await import("prettier/plugins/graphql")).default as Plugin;
  }
  throw new Error(`Unknown prettier plugin: ${name}`);
}

export async function beautify(
  source: string,
  language: Language,
  options: BeautifyOptions = {}
): Promise<string> {
  if (language === "sql") {
    const { format } = await import("sql-formatter");
    return format(source, {
      language: (options.sqlDialect ?? "sql") as
        | "sql"
        | "postgresql"
        | "mysql"
        | "sqlite"
        | "mariadb"
        | "snowflake"
        | "bigquery"
        | "trino"
        | "redshift"
        | "transactsql"
        | "plsql"
        | "duckdb",
      tabWidth: options.indent ?? 2,
      keywordCase: "upper",
    });
  }

  const spec = PRETTIER_PARSERS[language];
  if (!spec) throw new Error(`Beautify not supported for ${language}`);
  const prettier = await import("prettier/standalone");
  const plugins = await Promise.all(spec.plugins.map(loadPrettierPlugin));
  return prettier.format(source, {
    parser: spec.parser,
    plugins,
    tabWidth: options.indent ?? 2,
    printWidth: options.printWidth ?? 80,
  });
}
