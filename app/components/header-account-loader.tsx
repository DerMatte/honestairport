import { HeaderAccountMenu } from "@/app/components/header-account-menu";
import { getWhopProfileImage } from "@/lib/whop-access";
import type { ReactNode } from "react";

export async function HeaderAccountLoader({
  membershipSlot,
}: {
  membershipSlot?: ReactNode;
}) {
  const whopImage = await getWhopProfileImage();
  return (
    <HeaderAccountMenu membershipSlot={membershipSlot} whopImage={whopImage} />
  );
}
