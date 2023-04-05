import styles from "./style.module.scss"
import {CategoryTree} from "@/interfaces/post"
import React from "react"
import Link from "next/link"
import {metadata} from "@/lib/constants"
import FolderIcon from "@/Font-Awesome-Pro/svgs/solid/folder.svg"

export interface NavigationProps {
  categoryPath: string[],
  rootCategory: CategoryTree
  openState: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
}

export default function Navigation({categoryPath, rootCategory, openState}: NavigationProps) {
  const [open, setOpen] = openState

  return (
    <nav className={styles.navigation}>
      <div className={styles.top}>
        <Link as="/" href="/[[...path]]" className={styles.branding}>
          <div className={styles.icon}>{metadata.blogIcon}</div>
          <div className={styles.text}>{metadata.blogName}</div>
        </Link>
        <div className={`${styles.toggle} ${open ? styles.open : ""}`} onClick={() => setOpen(!open)}>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
        </div>
      </div>
      <div className={`${styles.items} ${styles.root}`}>
        {rootCategory.children.map((c) => (
          <CategoryRecursion key={c.path.join("/")} category={c} categoryPath={categoryPath}/>
        ))}
      </div>
    </nav>
  )
}


interface CategoryRecursionProps {
  categoryPath: string[]
  category: CategoryTree
}

function CategoryRecursion({categoryPath, category}: CategoryRecursionProps) {
  return (
    <div
      key={category.path.join("/")}
      className={`${styles.item} ${categoryPath.join("/") == category.path.join("/") ? styles.selected : ""}`}
    >
      <Link
        as={`/${category.path.join("/")}`}
        href={"/[...path]"}
        className={styles.info}
      >
        <div className={styles.icon}>
          {category.icon
            ? <div className={styles.customIcon} style={{"--icon": `url('${category.icon}');`} as React.CSSProperties}/>
            : <FolderIcon/>
          }
        </div>
        <div className={styles.name}>{category.name}</div>
      </Link>
      {category.children.length != 0 &&
        <div className={styles.items}>
          {category.children.map((c) => (
            <CategoryRecursion key={c.path.join("/")} category={c} categoryPath={categoryPath}/>
          ))}
        </div>
      }
    </div>
  )
}
