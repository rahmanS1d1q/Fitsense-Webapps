"use client";

/**
 * Navbar — backward compat wrapper.
 * Renders the Sidebar component. Existing pages that wrap content with
 * Navbar will get the sidebar layout automatically.
 */

import React, { useEffect } from "react";
import Sidebar from "./Sidebar";

export default function Navbar() {
  // Add a class to body to shift content
  useEffect(() => {
    document.body.classList.add("has-sidebar");
    return () => {
      document.body.classList.remove("has-sidebar");
    };
  }, []);

  return <Sidebar />;
}
