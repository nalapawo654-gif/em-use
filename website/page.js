const pets=/*PETS*/;
let selectedPet=pets.find(p=>p.id==='hamster'),selectedLook='original';
function showLook(){
  document.querySelector('#pet-image').src=selectedLook==='awakened'?selectedPet.awakenedImage:selectedPet.image;
  document.querySelector('#pet-image').alt=selectedPet.name+(selectedLook==='awakened'?'的 Codex 觉醒造型':'的原有造型')+' · 演示额度';
  document.querySelector('.stage-caption').textContent=(selectedLook==='awakened'?'Codex 觉醒造型':'原有造型')+' / 示例额度';
}
for(const button of document.querySelectorAll('[data-look]'))button.addEventListener('click',()=>{
  selectedLook=button.dataset.look;
  for(const option of document.querySelectorAll('[data-look]'))option.setAttribute('aria-pressed',String(option===button));
  showLook();
});
for(const button of document.querySelectorAll('[data-pet]'))button.addEventListener('click',()=>{
  const pet=pets.find(p=>p.id===button.dataset.pet);
  selectedPet=pet;showLook();
  document.querySelector('#pet-title').textContent=pet.name;
  document.querySelector('#pet-tag').textContent=pet.tag;
  document.querySelector('#pet-description').textContent=pet.description;
  document.querySelector('#pet-index').textContent=String(pets.indexOf(pet)+1).padStart(2,'0')+' / '+String(pets.length).padStart(2,'0');
  for(const option of document.querySelectorAll('[data-pet]'))option.setAttribute('aria-pressed',String(option===button));
});
