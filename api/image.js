
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Дозволено лише POST-запити"});

  const key=process.env.POLLINATIONS_KEY;
  if(!key)return res.status(500).json({error:"У Vercel не додано POLLINATIONS_KEY"});

  try{
    const {prompt,size="1024x1024"}=req.body||{};
    if(!prompt?.trim())return res.status(400).json({error:"Введіть опис зображення"});

    const response=await fetch("https://gen.pollinations.ai/v1/images/generations",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${key}`
      },
      body:JSON.stringify({
        prompt:prompt.trim(),
        model:"flux",
        size,
        n:1,
        response_format:"b64_json",
        safe:true
      })
    });

    const data=await response.json();
    if(!response.ok){
      console.error("Pollinations API error:",data);
      return res.status(response.status).json({error:data?.error?.message||data?.error||"Помилка генерації зображення"});
    }

    const item=data?.data?.[0]||{};
    return res.status(200).json({
      url:item.url||"",
      b64_json:item.b64_json||""
    });
  }catch(error){
    console.error(error);
    return res.status(500).json({error:"Не вдалося створити зображення"});
  }
}
