declare namespace tei = "http://www.tei-c.org/ns/1.0";

for $doc in collection('sema_corpus')//tei:TEI
let $fileDesc := $doc/tei:teiHeader/tei:fileDesc
let $profileDesc := $doc/tei:teiHeader/tei:profileDesc
return map {
  "title": string($fileDesc/tei:titleStmt/tei:title),
  "author": string($fileDesc/tei:titleStmt/tei:author),
  "date": string($profileDesc/tei:creation/tei:date),
  "genre": string($profileDesc/tei:textClass/tei:keywords/tei:term)
}
