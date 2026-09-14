# save as scripts/check_neo4j_db.py
import asyncio
from neo4j import AsyncGraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()


async def main():
    uri = os.environ["NEO4J_URI"]
    user = os.environ["NEO4J_USER"]
    pwd = os.environ["NEO4J_PASSWORD"]
    driver = AsyncGraphDatabase.driver(uri, auth=(user, pwd))
    async with driver.session() as session:
        # SHOW DATABASES lists all databases with their name, status, etc.
        res = await session.run("SHOW DATABASES YIELD name, currentStatus, default")
        rows = await res.data()
        print("\nAvailable databases:")
        for row in rows:
            marker = " <-- DEFAULT" if row.get("default") else ""
            print(f"  name={row['name']!r}  status={row['currentStatus']!r}{marker}")

        # Neo4j 5.x uses db.info() instead of the removed procedure
        res2 = await session.run("CALL db.info() YIELD id, name")
        row2 = await res2.single()
        if row2:
            print(
                f"\nCurrently connected database: name={row2['name']!r}  id={row2['id']!r}"
            )
    await driver.close()


asyncio.run(main())
