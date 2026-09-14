const pets=/*PETS*/;
for(const button of document.querySelectorAll('[data-pet]'))button.addEventListener('click',()=>{
  const pet=pets.find(p=>p.id===button.dataset.pet);
  document.querySelector('#pet-image').src=pet.image;
  document.querySelector('#pet-image').alt=pet.name+'的实际应用画面';
  document.querySelector('#pet-title').textContent=pet.name;
  document.querySelector('#pet-tag').textContent=pet.tag;
  document.querySelector('#pet-description').textContent=pet.description;
  document.querySelector('#pet-index').textContent=String(pets.indexOf(pet)+1).padStart(2,'0')+' / '+String(pets.length).padStart(2,'0');
  for(const option of document.querySelectorAll('[data-pet]'))option.setAttribute('aria-pressed',String(option===button));
});
