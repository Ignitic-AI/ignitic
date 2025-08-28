"use client"

import {useOrgStore} from "@/app/_store/useorgStore"
import AssetsPage from "@/components/Assets"

const page = () => {
  const {currentOrg} = useOrgStore()
  return (
    <div>page</div>
  )
}

export default page