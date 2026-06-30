import { useEffect, useRef, useState } from "react";
import { MapSpriteEditor } from "../../../src";
import type { MapSpriteEditorState, SvgIconInput } from "../../../src";
import { MapLibreSpriteTest } from "./MapLibreSpriteTest";

export default function App() {
  const [activeView, setActiveView] = useState<"editor" | "maplibre">("editor");
  const [editorState, setEditorState] = useState<MapSpriteEditorState | undefined>();

  return (
    <main className="example-app">
      <header className="example-header">
        <div>
          <h1>Map Sprite</h1>
          <p>SVG sprite generation and MapLibre compatibility checks.</p>
        </div>
        <nav className="example-tabs" aria-label="Example views">
          <button
            className={activeView === "editor" ? "is-active" : ""}
            type="button"
            onClick={() => setActiveView("editor")}
          >
            Sprite Editor
          </button>
          <button
            className={activeView === "maplibre" ? "is-active" : ""}
            type="button"
            onClick={() => setActiveView("maplibre")}
          >
            MapLibre Test
          </button>
        </nav>
      </header>
      {activeView === "editor" ? (
        <SpriteEditorPanel initialIcons={editorState?.icons ?? []} onChange={setEditorState} />
      ) : (
        <MapLibreSpriteTest sprite={editorState?.sprite} />
      )}
    </main>
  );
}

function SpriteEditorPanel({
  initialIcons,
  onChange,
}: {
  initialIcons: SvgIconInput[];
  onChange: (state: MapSpriteEditorState) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const editor = new MapSpriteEditor({
      container: containerRef.current,
      icons: initialIcons,
      onChange,
    });

    return () => editor.destroy();
  }, []);

  return <div className="example-shell" ref={containerRef} />;
}
