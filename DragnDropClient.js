function ($scope) {
  /* widget controller */
  var c = this;

  c.dragStart = function (event) {
    //change target appearance so we can see we have grabbed it
    event.target.style.opacity = '0.7';
    //change cursor
    event.target.style.cursor = 'grabbing';
    //prep for move
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.innerHTML);
    c.draggedNode = event.target.id;
    //ignore all other tasks until we are done
    document.querySelectorAll('.task').forEach(function (cur) {
      if (cur.id !== event.target.id) {
        cur.classList.add('disabled');
      }
    })
  };

  c.dragEnd = function (event) {
    event.target.style.opacity = '1';
    event.target.style.cursor = 'grab';
    var cols = document.querySelectorAll('.task-col-content');
    cols.forEach(function (cur) {
      cur.classList.remove('over')
    });
    document.querySelectorAll('.task').forEach(function (cur) {
      cur.classList.remove('disabled');
    })
  };

  c.dragEnter = function (event) {
    //set class for things being dragged over
    if (event.target && event.target.classList) {
      event.target.classList.add('over');
    }
  };

  c.dragLeave = function (event) {
    //remove class for things being dragged over
    if (event.target && event.target.classList) {
      event.target.classList.remove('over');
    }
  };

  c.dragOver = function (event) {
    if (event.preventDefault) {
      event.preventDefault(); // Necessary. Allows us to drop.
    }
    event.dataTransfer.dropEffect = 'move';
    return false;
  };

  //recursive function to determine where we drop
  function findColType(element) {
    var maxLevels = 4;
    return checkElement(element, 1);

    function checkElement(element, level) {
      if (!element) {
        return null;
      }
      if (level >= maxLevels) {
        return null;
      }
      if (element.classList && element.classList.contains('task-col')) {
        return element.id;
      }
      return checkElement(element.parentElement, level++);
    }
  }

  c.drop = function (event) {
    if (event.stopPropagation) {
      event.stopPropagation(); // stops the browser from redirecting.
    }
    var colType = findColType(event.target);
    c.data.tasks[parseInt(c.draggedNode)].state = colType;
    //apply changes to angular if necessary
    $scope.$apply();
  };
}