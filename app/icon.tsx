import { ImageResponse } from "next/og";
import { OG_BRAND_BLUE, PlaneIcon } from "@/lib/og-icons";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG_BRAND_BLUE,
          borderRadius: 9,
        }}
      >
        <PlaneIcon size={18} color="#fafafa" rotate={-45} />
      </div>
    ),
    size,
  );
}
