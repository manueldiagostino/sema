declare namespace tei = "http://www.tei-c.org/ns/1.0";

for $doc in db:open('sema_corpus')//tei:TEI
return string($doc/tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title)
