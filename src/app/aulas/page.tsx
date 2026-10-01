import { permanentRedirect } from "next/navigation";

const YOUTUBE_AULAS_CHANNEL = "https://www.youtube.com/channel/UCD6JKpbwJr2sTR5RaLOII7g";

export default function AulasPage() {
  permanentRedirect(YOUTUBE_AULAS_CHANNEL);
}
