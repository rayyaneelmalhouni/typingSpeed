<script>
   import Word from "./components/Word.svelte";
   import Typer	from "./components/Typer.svelte";
   import Score from "./components/Score.svelte";
   import Notice from "./components/Notice.svelte";

   import { onMount } from "svelte";
   let word = "";
   let time = 5;
   let starting = true;
   let score = 0;
   let answer = "";
   let appreciation = "";
   let handle = "";
   let interval;
   
   let data = []
   onMount(async () => {
	   const response = await fetch("https://random-word-api.herokuapp.com/word?number=300");
	   data = await response.json();
	   createWord()
   })
   function receive(e) {
	   appreciation = "";
	   handle = "";
	   answer = e.detail.text;
	   if (starting) {
		   score = 0;
		   time = 5;
		   interval = setInterval(() => {
			   time--;
			   if (time < 1) {
		   clearInterval(interval)
		   starting = true;
		   lost()
	   }
		   }, 1000);
		   starting = false;
	   }
	   if (answer === word && time > 0) {
		   createWord();
		   handle = "Correct"
		   time = 5;
		   score++;
	   }
	   
   }
   function lost() {
	   if (score > 30) {
		appreciation = "excuse me are you a boot"
	   }
	   else if (score > 20) {
		appreciation = "hacker";
	   }
	   else if (score > 15) {
		appreciation = "exellent";
	   }
	   else if (score > 10) {
		appreciation = "Very Good"
	   }
	   else if (score > 7) {
			
		appreciation = "Good"
	   }
	   else if (score > 3) {
		   
		appreciation = "Good for a bigginer";
	   }
	   else if (score >= 0) {
		
		appreciation = "You can do better";
	   } else {
		appreciation = ""
	   }
	   
   } 
   function createWord() {
	   let random = Math.floor(Math.random() * data.length)
	   word = data[random]
   }
</script>

<style>
   .container {
	   background-color: #5e5e5e;
	   min-height: 100vh;
	   width: 100%;
	   color: #F9F9F9;
	   
   }
   .title-container {
	   padding: 20px;
	   text-align: center;
	   background-color: #A9A9A9;
   }
   .title {
	   font-size: 1.7em;
   }
   @media only screen and (max-width: 600px) {
	   .title-container {
		   padding: 10px;
	   }
	   .title {
		   font-size: 1.3em;
	   }
   }
</style>
<div class="container">
<div class="title-container"><h1 class="title">Typing Speed</h1></div>
<Word {word}/>
<Typer on:message={receive} {word} {appreciation}/>
<Score {time} {score} {appreciation} {handle}/>
<Notice />
</div>