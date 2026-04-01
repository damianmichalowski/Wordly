import type { ImageSourcePropType } from "react-native";

/**
 * Flagi obok plików PNG: `require` względem tego katalogu, żeby Metro zawsze
 * poprawnie przypisał assety (niezależnie od miejsca importu w `src/`).
 */
export const FLAG_IMAGES: Record<string, ImageSourcePropType> = {
  gb: require("./gb.png"),
  pl: require("./pl.png"),
  de: require("./de.png"),
  es: require("./es.png"),
  it: require("./it.png"),
  in: require("./in.png"),
  pt: require("./pt.png"),
  tr: require("./tr.png"),
  fr: require("./fr.png"),
  ru: require("./ru.png"),
  ua: require("./ua.png"),
  cz: require("./cz.png"),
  sk: require("./sk.png"),
  nl: require("./nl.png"),
  se: require("./se.png"),
  no: require("./no.png"),
  dk: require("./dk.png"),
  fi: require("./fi.png"),
  gr: require("./gr.png"),
  ro: require("./ro.png"),
  hu: require("./hu.png"),
  jp: require("./jp.png"),
  kr: require("./kr.png"),
  cn: require("./cn.png"),
};
