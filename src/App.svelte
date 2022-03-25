<script>
   import Word from "./components/Word.svelte";
   import Typer	from "./components/Typer.svelte";
   import Score from "./components/Score.svelte";
   import Notice from "./components/Notice.svelte";

   import { onMount } from "svelte";
   let 	text = "";
   let word = "";
   let time = 0;
   let starting = true
   let score = 0;
   let answer = "";
   let interval;
   
   let data = []
   onMount(async () => {
	   const response = await fetch("https://random-word-api.herokuapp.com/word?number=300");
	   data = await response.json();
	   createWord()
   })
   function receive(e) {
	   console.log(e.detail.text)
	   answer = e.detail.text;
	   
	   if (starting) {
		start();
		starting = false;
	   }
	   
	   if (answer === word) {
		 createWord()
		 win();
		 starting = true;
	   }
	   if (time < 1) {
		   lose();
		   starting = true;
	   }
   }
   function createWord() {
	   let random = Math.floor(Math.random() * data.length)
	   word = data[random]
   }
   function clearComplete() {
	clearInput = false;
   }
   function start() {
	   time = 5;
	   interval = setInterval(() => {
		   time--;
	   }, 1000);
   }
   function win() {
	   clearInterval(interval)
	   time = 5;
	   score += 1;
   }
   function lose() {
	clearInterval(interval)
	   time = 5;
	   score = 0;
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
<Typer on:message={receive} {word}/>
<Score {time} {score}/>
<Notice />
</div>