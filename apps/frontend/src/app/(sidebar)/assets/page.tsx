"use client"

import AssetsPage from "@/components/Assets"
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingLogo } from "@/components/Loading";

const Page = () => {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <LoadingLogo />;
  }
  
  return (
    <AssetsPage/>
  )
}

export default Page