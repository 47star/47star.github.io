import {useRouter} from "next/router"
import Head from "next/head"
import {
  getAllCategories,
  getAllPostPaths,
  getAllPosts,
  getCategoryByPath,
  getCategoryTree,
  getPathType,
  getPostByPath,
  sortPosts
} from "@/lib/api"
import {PostType} from "@/interfaces/post"
import Container from "@/components/layout/container"
import PostMarkdown from "@/components/post/markdown/PostMarkdown"
import Layout, {LayoutProps} from "@/components/layout"
import PostList from "@/components/post/list"
import PostPreview from "@/components/post/preview"
import styles from "./style.module.scss"
import DateFormatter from "@/components/DateFormatter"
import Info from "@/components/layout/info"
import {metadata} from "@/lib/constants"
import {faStar} from "@fortawesome/pro-solid-svg-icons"

interface AppProps extends LayoutProps {
  category?: {
    path: string[],
    name: string
    icon?: string,
    posts: Array<{
      path: string[]
      title: string
      description: string
      date: string
      coverImage?: string
    }>
  }
  post?: PostType
}

export default function App({category, post, ...props}: AppProps) {
  const router = useRouter()

  if (!router.isFallback && !category && !post) {
    // return <ErrorPage statusCode={404} />
  }

  const isCategoryRoot = category?.path.join("/") == ""

  return (
    <Layout {...props}>
      {category &&
        <Container flex wide fill>
          <Head>
            <title>{`${category.name} - ${metadata.blogName}`}</title>
            <meta property="og:title" content={metadata.blogName}/>
            <meta
              property="og:description"
              content={isCategoryRoot
                ? metadata.description
                : `게시글 목록: ${category.name}`}
            />
          </Head>
          <section className={styles.category}>
            <div className={styles.header}>
              {category.icon
                ? <object className={styles.icon} data={category.icon}/>
                : <></>
              }
              <h1>{category.name}</h1>
            </div>
            {category.posts.length == 0
              ? <Info
                icon={faStar}
                title={"게시글 없음"}
                description={"표시할 게시글이 없습니다."}
              />
              : <PostList>
                {category.posts.map((post) => (
                  <PostPreview
                    key={post.path.join("/")}
                    title={post.title}
                    coverImage={post.coverImage}
                    date={post.date}
                    path={post.path}
                    description={post.description}
                  />
                ))}
              </PostList>
            }
          </section>
        </Container>
      }
      {post &&
        <Container>
          <article className={styles.article}>
            <Head>
              <title>{`${post.title} - ${metadata.blogName}`}</title>
              <meta property="og:title" content={`${post.title} - ${metadata.blogName}`}/>
              <meta property="og:description" content={post.description}/>
            </Head>
            <header className={styles.header}>
              <p className={styles.date}><DateFormatter dateString={post.date}/></p>
              <h1 className={styles.title}>{post.title}</h1>
            </header>
            <PostMarkdown content={post.content}/>
          </article>
        </Container>
      }
    </Layout>
  )
}

type Params = {
  params: {
    path: string[]
  }
}

export async function getStaticProps({params}: Params) {
  const currentPath = params.path || []
  const rootCategory = getCategoryTree()
  const type = getPathType(currentPath)

  if (type == "post") {
    const post = getPostByPath(currentPath, [
      "title",
      "description",
      "date",
      "path",
      "content",
      "ogImage",
      "coverImage",
    ])
    const content = post.content as string || ""

    currentPath.pop()

    return {
      props: {
        categoryPath: currentPath,
        rootCategory,
        post: {
          ...post,
          content,
        },
      },
    }
  } else if (type == "category") {
    const category = getCategoryByPath(currentPath)

    return {
      props: {
        categoryPath: currentPath,
        rootCategory,
        category: {
          path: category.path,
          name: category.name,
          icon: category.icon || null,
          posts: sortPosts(
            getAllPostPaths(category.path)
              .map((path) => getPostByPath(path, [
                "path",
                "title",
                "description",
                "date",
                "coverImage",
              ]))
          )
        }
      }
    }
  }
}

export async function getStaticPaths() {
  const posts = getAllPosts(["path"])
  const categories = getAllCategories()

  return {
    paths: [
      ...posts.map((post) => ({
        params: {
          path: post.path,
        },
      })),
      ...categories.map((category) => ({
        params: {
          path: category.path,
        },
      })),
    ],
    fallback: false,
  }
}
