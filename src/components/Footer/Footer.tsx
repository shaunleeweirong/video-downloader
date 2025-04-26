import Image from "next/image";
import Link from 'next/link';
import Container from "../Container";
import styles from "./Footer.module.css";
// import { FaTwitter, FaLinkedinIn, FaGithub, FaDiscord } from "react-icons/fa";
import type { Downloader } from "@/types";

// Removed medias array and icons

interface FooterProps {
  downloaders: Array<Downloader>;
}

const Footer = ({ downloaders }: FooterProps) => {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div className={styles["logo-wrapper"]}>
            <Image
              src="/logo-dark.png"
              alt="Dark logo"
              width={150}
              height={30}
            />
            <p className={styles.description}>
              A powerful video downloader which supports downloading from
              multiple websites built with performance and speed in mind.
            </p>
            {/* Social icons removed */}
          </div>
          {/* Downloaders section removed */}
        </div>
        <div className={styles.divider}>
          &copy; {new Date().getFullYear()} TheB2BHouse. All right reserved
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
