import fs from "fs"
import {join} from "path"
import matter from "gray-matter"
import {Category, CategoryTree, PostType} from "@/interfaces/post"

const postsDirectory = "_posts"

export function getPathType(path: string[]): "post" | "category" | null {
  const joinedPath = join(postsDirectory, ...path)

  if (fs.existsSync(joinedPath)) {
    const stat = fs.lstatSync(joinedPath)
    if (stat.isFile())
      return "post"

    if (stat.isDirectory())
      return "category"

    if (joinedPath.endsWith(".md"))
      return null
  }

  path = [...path]
  path[path.length - 1] += ".md"
  return getPathType(path)
}

const definable = ["name", "icon"]

export function getCategoryByPath(path: string[]): Category {
  const category: Category = {
    name: path.length == 0 ? "" : path[path.length - 1],
    path: path,
    posts: [],
  }

  const files = fs.readdirSync(
    join(process.cwd(), postsDirectory, ...path),
    {
      withFileTypes: true,
    },
  )

  const metaFile = files.find((f) => f.isFile() && f.name == "meta.json")
  if (metaFile) {
    const meta = JSON.parse(
      fs.readFileSync(
        join(process.cwd(), postsDirectory, ...path, metaFile.name),
        {encoding: "utf-8"}
      )
    )

    for (const key of definable) {
      if (meta[key]) {
        category[key] = meta[key]
      }
    }
  }

  for (const file of files) {
    if (file.isFile() && file.name.endsWith(".md")) {
      category.posts.push([...path, file.name.substring(0, file.name.length - 3)])
    }
  }

  return category
}

export function getCategoryTree(path?: string[]): CategoryTree {
  path = path || []

  const category: CategoryTree = {...getCategoryByPath(path), children: []}

  const files = fs.readdirSync(
    join(process.cwd(), postsDirectory, ...path),
    {
      withFileTypes: true,
    },
  )

  for (const file of files) {
    if (file.isDirectory()) {
      category.children.push(getCategoryTree([...path, file.name]))
    }
  }

  return category
}

export function getAllCategories(category?: CategoryTree): Category[] {
  category = category || getCategoryTree()
  return [category, ...category.children.flatMap((c) => getAllCategories(c))]
}


export function getPostByPath<T extends keyof PostType>(path: string[], fields: Array<T>): Pick<PostType, T> {
  const fullPath = join(process.cwd(), postsDirectory, ...path)
  const fileContents = fs.readFileSync(`${fullPath}.md`, "utf8")
  const {data, content} = matter(fileContents)

  const items: any = {}

  fields.forEach((field) => {
    if (field == "path")
      items[field] = path
    else if (field == "content")
      items[field] = content
    else
      items[field] = data[field] || null
  })

  return items as Pick<PostType, T>
}

export function getAllPostPaths(path?: string[]): Array<Array<string>> {
  const category = getCategoryTree(path)
  return [
    ...category.posts.map((s) => s),
    ...category.children.flatMap((c) => getAllPostPaths(c.path))
  ]
}

export function getAllPosts<T extends keyof PostType>(fields: Array<T>) {
  return getAllPostPaths()
    .map((slug) => getPostByPath(slug, fields))
}

export function sortPosts<T extends Pick<PostType, "date">>(posts: Array<T>) {
  return posts.sort((post1, post2) =>
    (post1.date < post2.date ? 1 : -1)
  )
}
