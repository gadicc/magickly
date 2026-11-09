"use client";

import SearchIcon from "@mui/icons-material/Search";
import IconButton from "@mui/material/IconButton";
import dynamic from "next/dynamic";
import { useState } from "react";

// No catalogue, search engine or dialog in the initial app-shell bundle.
const SearchDialog = dynamic(() => import("./SearchDialog"));

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <IconButton
        aria-label="Search the site"
        color="inherit"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <SearchIcon />
      </IconButton>
      {mounted ? (
        <SearchDialog open={open} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
