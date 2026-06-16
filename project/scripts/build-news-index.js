const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const newsDir = path.join(rootDir, "content", "news");
const outputPath = path.join(rootDir, "news-data.json");

const parseFrontmatter = (source) => {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    return { data: {}, body: source.trim() };
  }

  const data = {};
  const [, frontmatter, body] = match;

  frontmatter.split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    data[key] = rawValue.replace(/^["']|["']$/g, "");
  });

  return { data, body: body.trim() };
};

const readNews = () => {
  if (!fs.existsSync(newsDir)) return [];

  return fs
    .readdirSync(newsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const filePath = path.join(newsDir, fileName);
      const source = fs.readFileSync(filePath, "utf8");
      const { data, body } = parseFrontmatter(source);

      return {
        slug: fileName.replace(/\.md$/, ""),
        title: data.title || "Без назви",
        date: data.date || "",
        category: data.category || "Новини клубу",
        image: data.image || "",
        description: data.description || "",
        body,
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

fs.writeFileSync(outputPath, `${JSON.stringify(readNews(), null, 2)}\n`);
console.log(`News index generated: ${path.relative(rootDir, outputPath)}`);
