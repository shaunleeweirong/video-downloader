import React from "react";
import Image from "next/image";
import Link from 'next/link';
import Container from "../Container/Container";
import NavMenu from "../NavMenu/NavMenu";
import styles from "./Header.module.css";
import cn from "classnames";
import DownloaderLink from "../DownloaderLink";
import type { Downloader } from "@/types";


interface HeaderProps {
  onMenuClick: () => void;
  isOpen: boolean;
  downloaders: Array<Downloader>;
}

const Header = ({ onMenuClick, isOpen, downloaders }: HeaderProps) => {
  return (
    <header className={styles.navbar}>
      <Container className={styles["navbar-wrapper"]}>
        <Link href='/' className={styles["navbar-logo"]}>
          <Image src="/logo.png" alt="Logo Image" width={390} height={78} />
        </Link>
        <div onClick={onMenuClick} className={styles["navbar-icon"]}>
          <span
            className={cn(styles["mobile-icon"], {
              [styles["mobile-icon_open"]]: isOpen,
              [styles["mobile-icon_close"]]: !isOpen,
            })}
          />
        </div>
      </Container>
    </header>
  );
};

export default Header;
